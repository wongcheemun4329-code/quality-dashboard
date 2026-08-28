import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "/Users/cheemunwong/Documents/ChatGPT/Quality Dashboard/outputs/01a03d70-da8a-7722-80ed-1af387f07167/FFC Quality_MM Dashboard Transfer_Department_WorkOrder_PartType.xlsx";
const previewPath = "/private/tmp/ffc-quality-process-before.png";
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));

console.log((await workbook.inspect({
  kind: "table,region,computedStyle",
  sheetId: "Inspections",
  range: "A1:Z8",
  maxChars: 8000,
  tableMaxRows: 8,
  tableMaxCols: 26,
})).ndjson);

const preview = await workbook.render({
  sheetName: "Inspections",
  range: "A1:Z18",
  scale: 1,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
console.log(JSON.stringify({ previewPath }));
