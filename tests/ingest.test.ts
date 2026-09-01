import assert from "node:assert/strict";
import test from "node:test";
import { ingestItems, IngestionError } from "../src/ingest";
import { Item } from "../src/models/Item";

function createItem(id: string): Item {
  return {
    id,
    issueNumber: id,
    owner: "owner",
    repo: "repo",
    assignedTo: "",
    state: "open",
    lastModified: "2026-01-01T00:00:00Z",
    title: `Issue ${id}`,
    abstract: "",
    author: "author",
    content: `Issue ${id}`,
    url: `https://example.com/issues/${id}`,
  };
}

async function* createItems(ids: string[]): AsyncGenerator<Item> {
  for (const id of ids) {
    yield createItem(id);
  }
}

test("ingestItems processes every item when all uploads succeed", async () => {
  const processedIds: string[] = [];

  await ingestItems(createItems(["1", "2", "3"]), async (item) => {
    processedIds.push(item.id);
  });

  assert.deepEqual(processedIds, ["1", "2", "3"]);
});

test("ingestItems reports all failures after processing remaining items", async () => {
  const processedIds: string[] = [];
  const firstFailure = new Error("first failure");
  const secondFailure = new Error("second failure");

  await assert.rejects(
    ingestItems(createItems(["1", "2", "3", "4"]), async (item) => {
      processedIds.push(item.id);
      if (item.id === "2") {
        throw firstFailure;
      }
      if (item.id === "4") {
        throw secondFailure;
      }
    }),
    (error: unknown) => {
      assert.ok(error instanceof IngestionError);
      assert.equal(error.message, "Failed to ingest 2 item(s): 2, 4");
      assert.deepEqual(error.failures, [
        { itemId: "2", error: firstFailure },
        { itemId: "4", error: secondFailure },
      ]);
      return true;
    }
  );

  assert.deepEqual(processedIds, ["1", "2", "3", "4"]);
});
