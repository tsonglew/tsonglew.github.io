import type { SiteMeta as ThemeSiteMeta } from 'astro-pure/types'

export interface SiteMeta extends ThemeSiteMeta {
  articleModifiedDate?: string
}
