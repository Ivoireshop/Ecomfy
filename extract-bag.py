from PIL import Image, ImageChops

im = Image.open('public/ecomfy-logo.png').convert("RGBA")

# First, trim the whole image to remove outer white/transparent padding
def trim(im):
    bg = Image.new(im.mode, im.size, im.getpixel((0,0)))
    diff = ImageChops.difference(im, bg)
    diff = ImageChops.add(diff, diff, 2.0, -100)
    bbox = diff.getbbox()
    if bbox:
        return im.crop(bbox)
    return im

# Make white transparent
data = im.getdata()
new_data = []
for item in data:
    if item[0] > 240 and item[1] > 240 and item[2] > 240:
        new_data.append((255, 255, 255, 0))
    else:
        new_data.append(item)
im.putdata(new_data)

trimmed = trim(im)

# The bag is on the left. Let's assume the bag's width is approximately equal to the trimmed image's height
# since it's an icon.
w, h = trimmed.size
bag_width = int(h * 1.1) # slightly wider just in case
if bag_width > w:
    bag_width = w

bag = trimmed.crop((0, 0, bag_width, h))
bag = trim(bag) # trim again to perfectly bound the bag

# Now make it perfectly square by adding transparent padding
bw, bh = bag.size
size = max(bw, bh)
square_bag = Image.new('RGBA', (size, size), (255, 255, 255, 0))
square_bag.paste(bag, ((size - bw) // 2, (size - bh) // 2))

# Save
square_bag.save('public/favicon.png', 'PNG')
square_bag.save('public/favicon.ico', format='ICO', sizes=[(size, size)])
square_bag.save('public/app-icon-512.png', 'PNG')

print(f"Extracted bag. Original size: {w}x{h}. Bag size: {bw}x{bh}. Saved as {size}x{size} square.")
