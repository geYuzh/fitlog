path = r'C:\Users\18537\Documents\记录软件\fitness-tracker\app.js'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# Fix pinchStates - remove entry 3
c = c.replace(
    "var pinchStates = { 1: { lastScale: 1, startZoom: 1 }, 2: { lastScale: 1, startZoom: 1 }, 3: { lastScale: 1, startZoom: 1 } };",
    "var pinchStates = { 1: { lastScale: 1, startZoom: 1 }, 2: { lastScale: 1, startZoom: 1 } };"
)

# Remove empty line in pinch handler (where chart 3 was)
c = c.replace(
    "          else if (cn === 2 && newZoom !== zoom2) { zoom2 = newZoom; updateChart2(); }\n\n        }",
    "          else if (cn === 2 && newZoom !== zoom2) { zoom2 = newZoom; updateChart2(); }\n        }"
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
print('Pinch states cleaned')
