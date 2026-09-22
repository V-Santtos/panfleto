import { describe, expect, it } from "vitest"

import {
  createTaskDiagnostic,
  isAllowedKieDataUrl,
  isAllowedKieSourceUrl,
  isKieResultUrl,
  isKieHostedResultUrl,
  isKieTaskId,
  isKieTemporaryImageUrl,
  localizeKieTaskResult,
  taskIdFromCreateResponse,
  uploadFileName,
} from "./kieBackgroundRemoval"

describe("Kie background-removal boundary", () => {
  it.each([
    "https://images.openfoodfacts.org/images/products/789/100/037/9691/front_pt.18.full.jpg",
    "https://static.openfoodfacts.org/images/products/789/100/037/9691/front_pt.18.full.jpg",
  ])("accepts a public catalog image: %s", (url) => {
    expect(isAllowedKieSourceUrl(url)).toBe(true)
  })

  it.each([
    "http://images.openfoodfacts.org/images/products/789/front_pt.1.full.jpg",
    "https://images.openfoodfacts.org@untrusted.example/image.jpg",
    "https://untrusted.example/image.jpg",
    "data:image/png;base64,abc",
  ])("rejects a source outside the catalog allowlist: %s", (url) => {
    expect(isAllowedKieSourceUrl(url)).toBe(false)
  })

  it("accepts only a Kie-sized local image data URL", () => {
    expect(isAllowedKieDataUrl("data:image/png;base64,AAAA")).toBe(true)
    expect(isAllowedKieDataUrl("data:image/gif;base64,AAAA")).toBe(false)
    expect(isAllowedKieDataUrl("data:image/png;base64,not valid")).toBe(false)
  })

  it("accepts only Kie's temporary upload URL as the hand-off to the model", () => {
    expect(isKieTemporaryImageUrl("https://tempfile.redpandaai.co/abc/images/upload.png")).toBe(true)
    expect(isKieTemporaryImageUrl("https://untrusted.example/upload.png")).toBe(false)
  })

  it("retains an image extension for Kie's temporary upload", () => {
    expect(uploadFileName("data:image/jpeg;base64,AAAA")).toBe("embalagem-manual.jpg")
    expect(uploadFileName("data:image/webp;base64,AAAA")).toBe("embalagem-manual.webp")
  })

  it("accepts provider task IDs without assuming a model-specific prefix", () => {
    expect(isKieTaskId("task_recraft_1765177006198")).toBe(true)
    expect(isKieTaskId("task_other_1765177006198")).toBe(true)
    expect(isKieTaskId("recraft_1765177006198")).toBe(true)
    expect(isKieTaskId(" ")).toBe(false)
    expect(isKieTaskId("task\u0000bad")).toBe(false)
  })

  it("extracts the provider task ID and describes a divergent creation response without leaking it", () => {
    expect(taskIdFromCreateResponse({ code: 200, msg: "success", data: { taskId: "recraft_1765177006198" } })).toBe("recraft_1765177006198")
    expect(taskIdFromCreateResponse({ code: 200, msg: "success", data: { id: "unexpected" } })).toBeUndefined()
    expect(createTaskDiagnostic(200, { code: 200, msg: "success", data: { id: "unexpected" } })).toEqual({
      httpStatus: 200,
      providerCode: 200,
      providerMessage: "success",
      dataKeys: ["id"],
      taskIdType: "absent",
    })
  })

  it("rewrites a successful provider result to a same-origin image route", () => {
    const taskId = "recraft_1765177006198"
    expect(localizeKieTaskResult({
      data: {
        state: "success",
        resultJson: JSON.stringify({ resultUrls: ["https://cdn.example.com/cutout.png"], other: "kept" }),
      },
    }, taskId)).toEqual({
      data: {
        state: "success",
        resultJson: JSON.stringify({ resultUrls: [`/api/kie/remove-background/${taskId}/image`], other: "kept" }),
      },
    })
  })

  it("accepts only a public HTTPS result URL for the local image relay", () => {
    expect(isKieResultUrl("https://cdn.example.com/cutout.png")).toBe(true)
    expect(isKieHostedResultUrl("https://img-relay.kieops.com/o/result.png")).toBe(true)
    expect(isKieHostedResultUrl("https://cdn.example.com/cutout.png")).toBe(false)
    expect(isKieResultUrl("http://cdn.example.com/cutout.png")).toBe(false)
    expect(isKieResultUrl("https://127.0.0.1/internal.png")).toBe(false)
    expect(isKieResultUrl("https://user:pass@cdn.example.com/cutout.png")).toBe(false)
  })
})
