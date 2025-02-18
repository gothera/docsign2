import io
from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

fontPath = '../data/MonsieurLaDoulaise-Regular.ttf'

def signPDF(pdfPath: str, userName: str, userEmail: str, outputFile: str, 
            *, pageNum=0, x=400, y=200, height=50, width=100):

    packet = io.BytesIO()
    can = canvas.Canvas(packet, pagesize=letter)
    
    fontName = 'SignatureFont'
    try:
        
        pdfmetrics.registerFont(TTFont(fontName, fontPath))
        can.setFont(fontName, height)
    except Exception as e:
        print(e)
        fontName = 'Helvetica'
        can.setFont(fontName, height)

    textWidth = pdfmetrics.stringWidth(userName, fontName, height)
    
    fontSize = height
    if textWidth > width:
        fontSize = height * (width / textWidth)
    
    print(fontSize)
    can.setFont(fontName, fontSize)
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
    outputFile = path[:-4] + '.signed.pdf'

    signPDF(path, 'Adrian', '', outputFile)