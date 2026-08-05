"""Extract text from .docx files for analysis."""
import sys
import zipfile
import xml.etree.ElementTree as ET


def extract_docx_text(path):
    """Extract all text from a .docx file."""
    ns_w = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    with zipfile.ZipFile(path, "r") as z:
        with z.open("word/document.xml") as f:
            tree = ET.parse(f)
    root = tree.getroot()
    paragraphs = []
    for para in root.iter(f"{ns_w}p"):
        texts = []
        for t in para.iter(f"{ns_w}t"):
            if t.text:
                texts.append(t.text)
        if texts:
            paragraphs.append("".join(texts))
    return "\n\n".join(paragraphs)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python extract_docx.py <path_to_docx>")
        sys.exit(1)
    text = extract_docx_text(sys.argv[1])
    print(text)
