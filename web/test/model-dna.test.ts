import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanName, colourWord, modelDnaTags, type ModelMaterial } from "../src/model-dna";

const m = (o: Partial<ModelMaterial>): ModelMaterial => ({ name: "", color: null, alpha: 1, texture: null, object: null, facing: "side", aboveEye: false, coverage: 10, ...o });

test("SketchUp material names are cleaned", () => {
  assert.equal(cleanName("[Wood_Floor_Oak_2]"), "Wood Floor Oak");
  assert.equal(cleanName("concrete_board_formed"), "Concrete board formed");
});

test("colours get plain words", () => {
  assert.equal(colourWord("#ffffff"), "white");
  assert.equal(colourWord("#000000"), "black");
  assert.equal(colourWord("#808080"), "grey");
  assert.equal(colourWord("#7a4a2a"), "brown");
  assert.equal(colourWord("#2f5fd0"), "blue");
});

test("model materials become tags, biggest first, unpainted and tiny ones left out", () => {
  const tags = modelDnaTags(
    [
      m({ name: "White render", color: "#f0eee8", facing: "side", coverage: 30 }),
      m({ name: "Teak decking", color: "#8a5a35", texture: "teak.jpg", facing: "up", coverage: 12 }),
      m({ name: "Color_A01", color: "#3a6fd8", facing: "up", aboveEye: true, coverage: 5 }),
      m({ name: "Glass", color: "#9cc2d2", alpha: 0.3, object: "Window W1", coverage: 8 }),
      m({ name: "", color: null, coverage: 40 }),
      m({ name: "Brass", color: "#b08d57", object: "Door handle", coverage: 0.2 }),
    ],
    "exterior",
  );
  assert.deepEqual(tags, [
    "Walls and facade: White render, off-white",
    "Ground and paving: Teak decking, textured",
    "Window W1: Glass, blue, transparent",
    "Roof: blue surface (#3a6fd8)",
  ]);
});

test("interior surfaces are floor, ceiling and walls; generic group names are ignored", () => {
  const tags = modelDnaTags([m({ name: "Terrazzo", color: "#d8d2c8", facing: "up", object: "Group#12" }), m({ name: "Gypsum", color: "#ffffff", facing: "down" })], "interior");
  assert.deepEqual(tags, ["Floor: Terrazzo, light beige", "Ceiling: Gypsum, white"]);
});
