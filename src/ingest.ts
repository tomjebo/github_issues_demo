import { ExternalConnectors } from "@microsoft/microsoft-graph-types";
import { getClient } from "./graphClient";
import { Config } from "./models/Config";
import { Item } from "./models/Item";
import { getAllItems } from "./services/itemsService";
import { getExternalItemFromItem } from "./custom/getExternalItemFromItem";

export interface IngestionFailure {
  itemId: string;
  error: unknown;
}

export class IngestionError extends Error {
  constructor(public readonly failures: IngestionFailure[]) {
    const itemIds = failures.map((failure) => failure.itemId).join(", ");
    super(`Failed to ingest ${failures.length} item(s): ${itemIds}`);
    this.name = "IngestionError";
  }
}

/**
 * Loads the content into the Graph API.
 * @param config - The configuration object.
 * @param doc - The document to load.
 * @returns A promise that resolves when the content has been loaded.
 */
async function loadContent(
  client: ReturnType<typeof getClient>,
  config: Config,
  item: ExternalConnectors.ExternalItem
): Promise<void> {
  const itemId = item.id;

  // Remove the ID from the item to avoid conflicts
  delete item.id;

  try {
    const url = `/external/connections/${config.connector.id}/items/${itemId}`;

    config.context.log(`PUT ${url}`);
    config.context.log(JSON.stringify(item, null, 4));

    await client.api(url).header("content-type", "application/json").put(item);
  } catch (e) {
    config.context.error(`Failed to load ${itemId}: ${e.message}`);
    if (e.body) {
      config.context.error(`${JSON.parse(e.body, null)?.innerError?.message ?? ""}`);
    }
    throw e;
  }
}

export async function ingestItems(
  items: AsyncIterable<Item>,
  loadItem: (item: Item) => Promise<void>
): Promise<void> {
  const failures: IngestionFailure[] = [];

  for await (const item of items) {
    try {
      await loadItem(item);
    } catch (error) {
      failures.push({ itemId: item.id, error });
    }
  }

  if (failures.length > 0) {
    throw new IngestionError(failures);
  }
}

/**
 * Ensures that the content is ingested into the Graph API.
 * @param config - The configuration object.
 */
export async function ingestContent(config: Config, since?: Date): Promise<void> {
  const client = getClient();

  await ingestItems(getAllItems(config, since), async (item) => {
    const transformedItem = getExternalItemFromItem(item);

    // Copilot connector API, load content item by item
    // this is a custom implementation to load the content into the Graph API
    // you can customize this function to fit your needs
    // if you want to load the content in bulk, you can accumulate several items
    // and use the batch API
    // https://learn.microsoft.com/en-us/graph/json-batching?tabs=http
    await loadContent(client, config, transformedItem);
  });
}
