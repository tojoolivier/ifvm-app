from app.infrastructure.pdf_renderer import PDF_BASE_CSS, render_html_to_pdf


def test_render_html_to_pdf_produit_des_octets_pdf_valides():
    pdf = render_html_to_pdf("<html><body><h1>Titre</h1></body></html>")

    assert isinstance(pdf, bytes)
    assert pdf.startswith(b"%PDF-")


def test_render_html_to_pdf_applique_le_css_du_gabarit():
    html = f"<html><head><style>{PDF_BASE_CSS}</style></head><body>Contenu</body></html>"

    pdf = render_html_to_pdf(html)

    assert pdf.startswith(b"%PDF-")


def test_pdf_base_css_definit_le_format_a4_et_des_marges():
    assert "size: A4" in PDF_BASE_CSS
    assert "margin:" in PDF_BASE_CSS
