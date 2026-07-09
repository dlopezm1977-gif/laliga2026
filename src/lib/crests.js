const slugify = name =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '-');

export const crestUrl = name => `/crests/${slugify(name)}.png`;
