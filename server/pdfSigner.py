import io
from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


def signPDF(pdfPath: str, userName: str, userEmail: str, outputFile: str, 
            *, pageNum=0, x=400, y=500, height=10, width=10):

    packet = io.BytesIO()
    can = canvas.Canvas(packet, pagesize=letter)
    
    # Register a custom font if needed for a more signature-like appearance
    # Here, we're using a built-in font, but you can load a TTF for better customization
    # pdfmetrics.registerFont(TTFont('SignatureFont', 'path/to/your/font.ttf'))
    # can.setFont("SignatureFont", 18)  # or use 'Helvetica' for standard font
    can.setFont("Helvetica", 18)
    can.drawString(x ,y, userName)
    can.save()

    reader, writer = PdfReader(pdfPath), PdfWriter()
    
    packet.seek(0)
    tmpPage = PdfReader(packet).pages[0]
    page = reader.pages[pageNum]
    page.merge_page(tmpPage)
    writer.add_page(page)

    with open(outputFile, "wb") as outputFile:
        writer.write(outputFile)


if __name__ == '__main__':
    path = '/Users/Adrian/Projects/docsign2/data/Lease-Agreement.pdf'
    outputFile = path[:-4] + 'Signed.pdf'

    signPDF(path, 'Adrian', '', outputFile)