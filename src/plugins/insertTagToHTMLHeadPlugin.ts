import { HTMLElement, parse } from 'node-html-parser';
import type { Plugin } from '../plugin.js';
import type { DeploymentMode } from '../types.js';
import { readStreamText } from '../utils.js';

export interface InsertTagToHTMLHeadPluginOptions {
  targetModes?: DeploymentMode[];
  prepend?: InsertTagToHTMLHeadPluginTagOptions[];
  append?: InsertTagToHTMLHeadPluginTagOptions[];
}

export interface InsertTagToHTMLHeadPluginTagOptions {
  tag: string;
  attributes?: Record<string, string>;
}

export function insertTagToHTMLHeadPlugin(options: InsertTagToHTMLHeadPluginOptions): Plugin {
  function createElements(options: InsertTagToHTMLHeadPluginTagOptions[]) {
    return options.map((option) => {
      const tag = new HTMLElement(option.tag, {});
      if (option.attributes) {
        for (const [key, value] of Object.entries(option.attributes)) {
          tag.setAttribute(key, value);
        }
      }
      return tag;
    });
  }

  return {
    name: 'InsertTagToHTMLHeadPlugin',
    async transform({ name, stream, mode }) {
      if (options.targetModes && !options.targetModes.includes(mode)) return;
      if (!name.endsWith('.html') && !name.endsWith('.htm')) return;

      const html = await readStreamText(stream);
      const dom = parse(html);

      const head = dom.querySelector('head');
      if (!head) return;

      head.childNodes = [
        ...(options.prepend ? createElements(options.prepend) : []),
        ...head.childNodes,
        ...(options.append ? createElements(options.append) : []),
      ];

      return dom.toString();
    },
  };
}
