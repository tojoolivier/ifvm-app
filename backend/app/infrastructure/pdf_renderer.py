from weasyprint import HTML

# Base commune aux gabarits de #494 (fiche de vol) et #495 (CRT), pour un rendu
# visuel cohérent entre les deux documents malgré des gabarits écrits séparément.
PDF_BASE_CSS = """
@page {
    size: A4;
    margin: 2cm 1.5cm;
}

body {
    font-family: "Helvetica", "Arial", sans-serif;
    font-size: 11pt;
    color: #111827;
}
"""


def render_html_to_pdf(html: str) -> bytes:
    return HTML(string=html).write_pdf()
