from PIL import Image, ImageChops

def trim(im):
    bg = Image.new(im.mode, im.size, im.getpixel((0,0)))
    diff = ImageChops.difference(im, bg)
    diff = ImageChops.add(diff, diff, 2.0, -100)
    bbox = diff.getbbox()
    if bbox:
        return im.crop(bbox)
    return im

im = Image.open('public/ecomfy-logo.png')
# Ensure it has alpha channel
im = im.convert("RGBA")
# For trimming, get the background color from top-left pixel
bg_color = im.getpixel((0,0))
# if the background is actually white, make it transparent
data = im.getdata()
new_data = []
for item in data:
    # change all white (also shades of white)
    # to transparent
    if item[0] in list(range(240, 256)) and item[1] in list(range(240, 256)) and item[2] in list(range(240, 256)):
        new_data.append((255, 255, 255, 0))
    else:
        new_data.append(item)
im.putdata(new_data)

trimmed = trim(im)

# Make it square
w, h = trimmed.size
size = max(w, h)
new_im = Image.new('RGBA', (size, size), (255, 255, 255, 0))
new_im.paste(trimmed, ((size - w) // 2, (size - h) // 2))

new_im.save('public/favicon.png', 'PNG')
new_im.save('public/favicon.ico', format='ICO', sizes=[(size, size)])
new_im.save('public/app-icon-512.png', 'PNG')

print("Cropped and saved")
