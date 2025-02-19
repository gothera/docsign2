from contextlib import asynccontextmanager
from database import DBMock
from document import FormField, DocumentMetadata, DocumentStatus, InternalDocument
from documentEditor import DocEditor
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Body, Query, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional
import base64
import httpx
import json
import mailService
import os
import pdfSigner


load_dotenv()
rootPath = os.getenv('PATH_TO_ROOT')
load_dotenv(os.path.join(rootPath, '.env'))

sendMailEnabled = os.getenv('SEND_MAIL_ENABLED', False)
documentsFolder = os.path.join(rootPath, 'data')
print(rootPath, documentsFolder)

openaiApiKey = os.getenv('OPENAI_API_KEY')

EDIT_PARAGRAPH = 'editParagraph'
DELETE_TEXT = 'deleteText'
ADD_PARAGRAPH = 'addParagraph'

OLD_PARAGRAPH = 'oldParagraph'
NEW_PARAGRAPH = 'newParagraph'
TEXT = 'text'
TEXT_BEFORE = 'textBefore'
ADDED_TEXT = 'addedText'

defaultEmail = 'cosmin@gmail.com'
defaultName = 'Cosmin'

# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     # Serve static files
#     yield
#     pass
# app = FastAPI(lifespan=lifespan)
app = FastAPI()
userDocumetsMap = DBMock()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:3000'],  # Your React app's origin
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

@app.post('/function-call')
async def callFunction(
    docxPath: str = Body(..., alias='document_id', description='the path to the document for now'), 
    functionName: str = Body(..., alias='function_name'), 
    arguments: dict = Body(...),
):
    print(f'function-call: docxPath: {docxPath}, functionName: {functionName}, arguments: {arguments}')
    
    outputFileName = os.path.join(documentsFolder, os.path.basename(docxPath))
    outputFileName = outputFileName if '_output.pdf' in outputFileName else outputFileName[:-5] + '_output.docx' 
    
    try:
        editor = DocEditor(docxPath, debug=True, outputFileName=outputFileName)
    except Exception as e:
        print(e)
        raise HTTPException(status_code=401, detail=f'document_id must be a valid path (exception: {e})')
    
    if functionName == EDIT_PARAGRAPH:
        if len(arguments) != 2 or OLD_PARAGRAPH not in arguments or NEW_PARAGRAPH not in arguments:
            raise HTTPException(status_code=400, detail=f'{EDIT_PARAGRAPH} takes 2 arguments ({OLD_PARAGRAPH}, {NEW_PARAGRAPH}, but {len(arguments)} was provided: {arguments}')
        
        oldParagraph, newParagraph = arguments[OLD_PARAGRAPH], arguments[NEW_PARAGRAPH]
        editor.replaceText(oldParagraph, newParagraph, save=True)
    elif functionName == ADD_PARAGRAPH:
        if len(arguments) != 2 or TEXT_BEFORE not in arguments or ADDED_TEXT not in arguments:
            raise HTTPException(status_code=400, detail=f'{ADD_PARAGRAPH} takes 2 arguments ({TEXT_BEFORE}, {ADDED_TEXT}), but {len(arguments)} was provided: {arguments}')
        
        textBefore, addedText = arguments[TEXT_BEFORE], arguments[ADDED_TEXT]
        editor.addParagraph(textBefore, addedText, save=True)
    elif functionName == DELETE_TEXT:
        if len(arguments) != 1 or TEXT not in arguments:
            raise HTTPException(status_code=400, detail=f'{DELETE_TEXT} takes 1 argument but {len(arguments)} was provided: {arguments}')
        
        text = arguments[TEXT]
        editor.removeText(text, save=True)
    else:
        raise HTTPException(status_code=400, detail=f'function_name must be in {[EDIT_PARAGRAPH, DELETE_TEXT, ADD_PARAGRAPH]}')

    try:
        with open(outputFileName, 'rb') as file:
            documentBytes = file.read()
            base64Encoded = base64.b64encode(documentBytes).decode('utf-8')
        return JSONResponse(content={'content': base64Encoded}, status_code=200)
        # return JSONResponse(content={'content': base64Encoded, 'outputFileName': outputFileName}, status_code=200)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to read output document: {str(e)}')


@app.post('/request-signature')
async def requestSignature(
    path: str = Form(..., alias='document_id', description='Document Path for now'),
    signerEmail: str = Form(..., alias='signer_email', description='email of the signer for now'),
    signerName: Optional[str] = Form(None, alias='signer_name', description='name of the signer'),
    senderEmail: Optional[str] = Form(None, alias='sender_email', description='email of the sender for now'),
    senderName: Optional[str] = Form(None, alias='sender_name', description='name of the sender'),
    documentName: Optional[str] = Form(None, alias='document_name', description='the name of the document, if not provided will be infered fromthe path'),
    formFields: str = Form(..., alias='form_field'),
    pdf: UploadFile = File(..., alias='file')
):
    try:
        documentBytes = await pdf.read()
    except base64.binascii.Error as e:
        raise ValueError(f"Couldn't get bytes: {e}")
    
    path = os.path.join(documentsFolder, os.path.basename(path))
    
    print(f"requestSignature: {len(documentBytes)} bytes, formFields: {formFields}\nFull path: {path}")
    # try:
    document = InternalDocument.initFromPath(path=path)
    document.formFields = json.loads(formFields)
    document.metadata = DocumentMetadata(
        id=InternalDocument.getIdFromPath(path),
        name=documentName if documentName else document.path.rsplit('/')[-1],
        senderEmail=senderEmail if senderName else defaultEmail,
        senderName=senderName if senderName else defaultName,
        signerEmail=signerEmail,
        signerName=signerName if signerName else defaultName,
        status=DocumentStatus.WAITING
    )
    print(document.path)
    document.save()

    with open(document.pdfPath, 'wb') as file:
        file.write(documentBytes)
    
    userDocumetsMap.add(document.id, document.metadata.senderEmail)
    userDocumetsMap.add(document.id, document.metadata.signerEmail)

    url = f'http://localhost:3000/sign/{document.id}'
    print(url)
    
    if sendMailEnabled: 
        await mailService.sendMail(document.metadata.signerEmail, url, document.metadata.signerName)

    return JSONResponse(content={'id': document.id}, status_code=200)
    
    # except Exception as e:
    #     raise HTTPException(status_code=500, detail=f'Error: {str(e)}')


@app.get('/document')
async def getDocument(
    id: str = Query(..., description='The ID of the document')
):
    # try:
    document = InternalDocument.initFromId(id)
    if not os.path.exists(document.pdfPath):
        raise ValueError(f'Document with id {id} decoded {document.pdfPath}, was not found')
    if not os.path.exists(document.formFieldsPath):
        raise ValueError(f'Document with id {id} decoded {document.formFieldsPath} was not found')
    
    # with open(document.docxPath, 'rb') as file:
    #     docxBytes = file.read()
    #     docxBase64Encoded = base64.b64encode(docxBytes).decode('utf-8')
    
    with open(document.pdfPath, 'rb') as file:
        pdfbytes = file.read()
        pdfBase64Encoded = base64.b64encode(pdfbytes).decode('utf-8')
        # with open(document.signPdfPath, 'rb') as file:
        #     signedPdfBytes = file.read()
        #     signedPdfBase64Encoded = base64.b64encode(signedPdfBytes).decode('utf-8')
        
    content = {
        'id': document.id, 
        'pdf': pdfBase64Encoded, 
        'form_fields': document.formFields,
    }
    return JSONResponse(content, status_code=200)
    # except Exception as e:
    #     raise HTTPException(status_code=500, detail=f'Error retrieving document: {str(e)}')


@app.post("/sign")
async def sign(
    pdf: UploadFile = Form(...), 
    documentId: str = Body(..., alias='document_id')
):
    print("Sign endpoint: ", documentId)
    try:
        document = InternalDocument.initFromId(documentId)
    except base64.binascii.Error as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 encoding in the document: {e}")
    
    if not pdf or not os.path.exists(document.pdfPath):
        raise HTTPException(status_code=400, detail="No content found in the request body.")
    
    try:
        documentBytes = await pdf.read() 
        with open(document.pdfPath, 'wb') as file:
            file.write(documentBytes)
    except base64.binascii.Error as e:
        raise ValueError(f"Couldn't get bytes or couldn't save file: {e}")

    try:
        # find signature form field
        signff = None
        for ff in document.formFields:
            if ff['type'] == 'Signature':
                signff = ff
        
        if ff:
            pdfSigner.signPDF(document.pdfPath, document.metadata.signerName, document.metadata.signerEmail, document.signPdfPath, 
                              pageNum=ff['pageNumber'] - 1, x=ff['x'], y=ff['y'], width=ff['width'], height=ff['height'])
        else:
            pdfSigner.signPDF(document.pdfPath, document.metadata.signerName, document.metadata.signerEmail, document.signPdfPath)
        
        document.metadata.status = DocumentStatus.SIGNED
        document.save()
        with open(document.signPdfPath, 'rb') as file:
            documentBytes = file.read()
            base64Encoded = base64.b64encode(documentBytes).decode('utf-8')
            
        return JSONResponse(status_code=200, content={'id': document.id, 'signed_pdf': base64Encoded})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Error retrieving document: {str(e)}')


@app.get('/documents')
async def getDocumentsList(userEmail: str = Query(..., alias='user_email')):
    sent, received = [], []

    for documentId in userDocumetsMap.getDocuments(userEmail):
        document = InternalDocument.initFromId(documentId)
        if document and not document.metadata:
            print(f'Miss match, document: {document.path}, id: {document.id} has no metadata at: {document.metadataPath}')
            continue
        if document.metadata.signerEmail == userEmail:
            received.append(document.metadata)
        if document.metadata.senderEmail == userEmail:
            sent.append(document.metadata)
    
    content = {
        'sent': [md.toDict() for md in sent],
        'received': [md.toDict() for md in received],
    }
    print(f'response: {content}')
    return JSONResponse(content, status_code=200)


@app.get('/token')
async def getToken():
    if not openaiApiKey:
        raise HTTPException(status_code=500, detail='OPENAI_API_KEY not set in environment')

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                'https://api.openai.com/v1/realtime/sessions',
                headers={
                    'Authorization': f'Bearer {openaiApiKey}',
                    'Content-Type': 'application/json',
                },
                json={
                    'model': 'gpt-4o-realtime-preview-2024-12-17',
                    'voice': 'verse',
                }
            )
            response.raise_for_status()
            return JSONResponse(content=response.json(), status_code=200)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


def main():
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=int(os.getenv('PORT', 8000)))


if __name__ == '__main__':
    main()
