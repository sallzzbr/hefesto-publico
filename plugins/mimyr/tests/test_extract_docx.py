"""Tests for docx text extraction used in pedagogical analysis."""

from __future__ import annotations

import sys
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape


sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from extract_docx import extract_docx_text


def write_minimal_docx(path: Path, paragraphs: list[str]) -> None:
    body = "".join(
        f"<w:p><w:r><w:t>{escape(paragraph)}</w:t></w:r></w:p>"
        for paragraph in paragraphs
    )
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{body}</w:body>"
        "</w:document>"
    )
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("word/document.xml", document_xml)


def test_extract_docx_text_reads_paragraphs_from_temp_file(tmp_path: Path) -> None:
    path = tmp_path / "aula.docx"
    write_minimal_docx(
        path,
        [
            "Primeiro paragrafo da aula.",
            "Segundo paragrafo com API e UX.",
            "Fechamento do roteiro.",
        ],
    )

    text = extract_docx_text(path)

    assert text == (
        "Primeiro paragrafo da aula.\n\n"
        "Segundo paragrafo com API e UX.\n\n"
        "Fechamento do roteiro."
    )
