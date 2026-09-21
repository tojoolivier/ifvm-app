from weasyprint import HTML

# Base commune aux gabarits PDF (aujourd'hui : le CRT), pour un rendu visuel
# cohérent entre les documents malgré des gabarits écrits séparément.
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
