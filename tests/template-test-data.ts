/** Offline text-transport fixture. Artwork is instantiated by production locally. */
import { titles } from './ant-motion-art';
import type { TemplateId } from '../server/science-templates';
const ids: TemplateId[] = ['soil-colony', 'ant-tunnel', 'colony-chamber', 'focus', 'overview'];
export function planReply(i = 0, revised = false) {
  return {
    title: titles[i % titles.length],
    template: ids[i % ids.length],
    palette: revised ? 'ember' : 'night',
    accent: revised ? 'gold' : 'cyan',
    speed: revised ? 'slow' : 'normal',
  };
}
