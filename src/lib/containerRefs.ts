import type { Container, Image, Stack } from './types'

// Docker normally reports a container's `Image` as the tag it was created
// from ("nginx:latest"), but containers created from an image id — and
// containers rebuilt by some recreate flows — report a bare id/digest
// ("sha256:8f3a…" or a 64-char hex string) instead. That value is NOT a
// pullable reference and it doesn't match any `RepoTags` entry, so every code
// path that pulls the image or matches it against the image list has to
// resolve the real tag first. That is what this module is for.

/** True for a bare image id/digest, or for an empty/missing reference. */
export function isImageId(ref?: string | null): boolean {
  const r = (ref || '').trim()
  if (!r) return true
  // A digest reference ("nginx@sha256:…") or a real tag ("nginx:latest") is
  // pullable, so it is not an id — only a bare id/digest is.
  if (/^sha256:[0-9a-f.]{8,}$/i.test(r)) return true
  if (/^[0-9a-f]{12,64}$/i.test(r)) return true
  return false
}

/** Lowercase an image id without its `sha256:` prefix, for comparisons. */
export function stripSha(id?: string): string {
  return (id || '').replace(/^sha256:/i, '').toLowerCase()
}

/** First usable repo tag of an image (skips the "<none>" placeholder). */
export function firstTag(tags?: string[]): string {
  return (tags || []).find((t) => t && !t.includes('<none>')) || ''
}

/** The repo tag of the local image with this id, or '' when it is untagged. */
export function tagForImageId(images: Image[], imageId?: string): string {
  const wanted = stripSha(imageId)
  if (!wanted) return ''
  const img = images.find((i) => stripSha(i.Id) === wanted)
  return img ? firstTag(img.RepoTags) : ''
}

/**
 * A pullable reference for the image a container runs. Prefers the tag Docker
 * reported; when that is an id/digest, falls back to the repo tag of the local
 * image the container was created from. Returns null when neither is available
 * — callers should explain that rather than pull a meaningless id.
 */
export function resolveContainerImage(c: Pick<Container, 'Image' | 'ImageID'>, images: Image[]): string | null {
  const raw = (c.Image || '').trim()
  if (raw && !isImageId(raw)) return raw
  return tagForImageId(images, c.ImageID) || null
}

/** Whatever is best shown for a container's image in the UI. */
export function containerImageLabel(c: Pick<Container, 'Image' | 'ImageID'>, images: Image[]): string {
  return resolveContainerImage(c, images) || (c.Image || '').trim() || 'unknown'
}

export type ImageState = 'current' | 'stale' | 'unknown'

/**
 * "current" = the tag the container runs still points at the image it was
 * created from; "stale" = a newer image was pulled for that tag and the
 * container needs recreating to pick it up; "unknown" = we cannot tell (the
 * image is untagged, or it is no longer on the host).
 */
export function containerImageState(c: Pick<Container, 'Image' | 'ImageID'>, images: Image[]): ImageState {
  const used = stripSha(c.ImageID)
  if (!used) return 'unknown'
  const ref = (c.Image || '').trim()
  if (!ref || isImageId(ref)) {
    // We know exactly which image the container runs, but not which repo tag
    // points at it — so the only honest answer is whether that image still
    // exists locally (if the tag moved away, it is gone and we say unknown).
    return tagForImageId(images, c.ImageID) ? 'current' : 'unknown'
  }
  const img = images.find((i) => i.RepoTags?.includes(ref))
  const local = stripSha(img?.Id)
  if (!local) return 'unknown'
  return local === used ? 'current' : 'stale'
}

/**
 * The stack (compose project) a container belongs to, if any. Compose labels
 * are authoritative; the name-prefix match is the same fallback the stack
 * screen uses for containers deployed without labels.
 */
export function stackForContainer(c: Pick<Container, 'Names' | 'Labels'>, stacks: Stack[]): Stack | undefined {
  const project = (c.Labels?.['com.docker.compose.project'] || c.Labels?.['com.docker.compose.stack'] || '').toLowerCase()
  if (project) return stacks.find((s) => s.Name.toLowerCase() === project)
  const cname = (c.Names[0] || '').replace(/^\//, '').toLowerCase()
  if (!cname) return undefined
  return stacks.find((s) => {
    const name = s.Name.toLowerCase()
    return cname === name || cname.startsWith(name + '-') || cname.startsWith(name + '_')
  })
}
