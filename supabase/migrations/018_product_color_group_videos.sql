-- Per colour variant product videos (Cloudinary URLs), alongside images.
ALTER TABLE product_color_groups
  ADD COLUMN IF NOT EXISTS videos text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN product_color_groups.videos IS 'Ordered Cloudinary video URLs for this colour variant gallery';
