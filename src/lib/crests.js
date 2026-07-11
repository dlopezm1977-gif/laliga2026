const slugify = name =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '-');

export const crestUrl = name => `${import.meta.env.BASE_URL}crests/${slugify(name)}.png`;
