import io
import os
from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
 

rootPath = os.getenv('PATH_TO_ROOT')
fontPath = os.path.join(rootPath, 'data/MonsieurLaDoulaise-Regular.ttf')


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

    reader = PdfReader(pdfPath)
    page = reader.pages[pageNum]
    pageHeight = float(page.mediabox.height)

    can.setFont(fontName, fontSize)
    can.drawString(x, pageHeight - y - fontSize, userName)
    can.save()

    writer = PdfWriter()
    
    for i in range(0, pageNum):
        writer.add_page(reader.pages[i])

    packet.seek(0)
    tmpPage = PdfReader(packet).pages[0]
    page = reader.pages[pageNum]
    page.merge_page(tmpPage)
    writer.add_page(page)

    for i in range(pageNum + 1, len(reader.pages)):
        writer.add_page(reader.pages[i])

    with open(outputFile, "wb") as outputFile:
        writer.write(outputFile)


if __name__ == '__main__':
    path = os.path.join(rootPath, 'data/Lease-Agreement.pdf')
    outputFile = path[:-4] + '.signed.pdf'

    signPDF(path, 'Adrian', '', outputFile)