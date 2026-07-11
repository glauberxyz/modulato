import type { ContentAdapter } from 'modulato/config'

export interface LocalJsonOptions {
  /** Directory of *.json files, relative to the project root. Default: `content`. */
  dir?: string
}

/** Local JSON content: `<dir>/<name>.json` → `content.<name>`. */
export declare function localJson(options?: LocalJsonOptions): ContentAdapter
