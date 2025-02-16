from contextlib import asynccontextmanager
from document import FormField, DocumentMetadata, DocumentStatus, InternalDocument
from documentEditor import DocEditor
from fastapi import FastAPI, HTTPException, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import base64
import httpx
import os
from typing import List, Optional
import mailService
import pdfSigner
from database import DBMock


openai_api_key = os.getenv('OPENAI_API_KEY')

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
    documentId: str = Body(..., alias='document_id'), 
    functionName: str = Body(..., alias='function_name'), 
    arguments: dict = Body(...),
):
    print(arguments)
    outputFileName = documentId[:-5] + '_output.docx'
    try:
        editor = DocEditor(documentId, debug=True, outputFileName=outputFileName)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f'document_id must be a valid path (exception: {e})')
    
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
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to read output document: {str(e)}')


@app.post('/request-signature')
async def requestSignature(
    path: str = Body(..., alias='document_id', description='Document Path for now'),
    signerEmail: str = Body(..., alias='signer_email', description='email of the signer for now'),
    signerName: Optional[str] = Body(None, alias='signer_name', description='name of the signer'),
    senderEmail: Optional[str] = Body(None, alias='sender_email', description='email of the sender for now'),
    senderName: Optional[str] = Body(None, alias='sender_name', description='name of the sender'),
    documentName: Optional[str] = Body(None, alias='document_name', description='the name of the document, if not provided will be infered fromthe path'),
    formFields: List = Body(..., alias='form_field'),
    pdf: Optional[str] = Body('')
):
    if not formFields:
        raise HTTPException(status_code=400, detail='Form fields required')
    if pdf:
        try:
            documentBytes = base64.b64decode(pdf)
        except base64.binascii.Error as e:
            raise ValueError(f"Invalid base64 encoding in the document: {e}")
    
    # try:
    document = InternalDocument.initFromPath(path=path)
    document.formFields = formFields
    document.metadata = DocumentMetadata(
        id=InternalDocument.getIdFromPath(path),
        name=documentName if documentName else document.path.rsplit('/')[0],
        senderEmail=senderEmail if senderName else defaultEmail,
        senderName=senderName if signerName else defaultName,
        signerEmail=signerEmail,
        signerName=signerName if signerName else defaultName,
        status=DocumentStatus.WAITING
    )
    document.save()
    if pdf:
        with open(document.pdfPath, 'wb') as file:
            file.write(documentBytes)
    
    userDocumetsMap.add(document.id, senderEmail)
    userDocumetsMap.add(document.id, signerEmail)

    url = f'http://localhost:3000/sign?id={document.id}'
    print(url)

    await mailService.sendMail(document.metadata.signerEmail, url, document.metadata.signerName)

    return JSONResponse(content={'id': document.id}, status_code=200)
    
    # except Exception as e:
    #     raise HTTPException(status_code=500, detail=f'Error: {str(e)}')


@app.get('/document')
async def getDocument(
    id: str = Query(..., alias='id', description='The ID of the document')
):
    # try:
    document = InternalDocument.initFromId(id)
    if not os.path.exists(document.docxPath):
        raise ValueError(f'Document with id {id} decoded {document.docxPath}, was not found')
    if not os.path.exists(document.formFieldsPath):
        raise ValueError(f'Document with id {id} decoded {document.formFieldsPath} was not found')
    
    with open(document.docxPath, 'rb') as file:
        docxBytes = file.read()
        docxBase64Encoded = base64.b64encode(docxBytes).decode('utf-8')
    
    pdfBase64Encoded, signedPdfBase64Encoded = '', ''
    try:
        with open(document.pdfPath, 'rb') as file:
            pdfbytes = file.read()
            pdfBase64Encoded = base64.b64encode(pdfbytes).decode('utf-8')
        with open(document.signPdfPath, 'rb') as file:
            signedPdfBytes = file.read()
            signedPdfBase64Encoded = base64.b64encode(signedPdfBytes).decode('utf-8')
    except:
        pass
        
    content = {
        'id': document.id, 
        'docx': docxBase64Encoded, 
        'pdf': pdfBase64Encoded, 
        'signed_pdf': signedPdfBase64Encoded, 
        'form_fields': document.formFields,
    }
    return JSONResponse(content, status_code=200)
    # except Exception as e:
    #     raise HTTPException(status_code=500, detail=f'Error retrieving document: {str(e)}')


@app.post("/sign")
async def sign(
    pdf: str = Body(...), 
    documentId: Optional[str] = Body(..., alias='document_id')
):
    print("Sign endpoint: args: ", documentId)
    try:
        document = InternalDocument.initFromId(documentId)
    except base64.binascii.Error as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 encoding in the document: {e}")
    
    if not pdf or not os.path.exists(document.pdfPath):
        raise HTTPException(status_code=400, detail="No content found in the request body.")
    
    if pdf:
        try:
            documentBytes = base64.b64decode(pdf)
        except base64.binascii.Error as e:
            raise ValueError(f"Invalid base64 encoding in the document: {e}")

    try:
        if pdf:
            with open(document.pdfPath, 'wb') as file:
                file.write(documentBytes)

        pdfSigner.signPDF(document.pdfPath, document.metadata.signerName, document.metadata.signerEmail, document.signPdfPath)
        
        document.metadata.status = DocumentStatus.SIGNED
        document.save()

        return JSONResponse(status_code=200, content={'id': document.id})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Error retrieving document: {str(e)}')


@app.get('/documents')
async def getDocumentsList(userEmail: str = Query(..., alias='user_email')):
    sent, received = [], []

    for documentId in userDocumetsMap.getDocuments(userEmail):
        document = InternalDocument.initFromId(documentId)
        if document.metadata.signerEmail == userEmail:
            received.append(document.metadata)
        if document.metadata.senderEmail == userEmail:
            sent.append(document.metadata)
    
    content = {
        'sent': [s.toDict() for s in sent],
        'received': [s.toDict() for s in sent],
    }
    print(content)
    return JSONResponse(content, status_code=200)


@app.get('/token')
async def getToken():
    if not openai_api_key:
        raise HTTPException(status_code=500, detail='OPENAI_API_KEY not set in environment')

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                'https://api.openai.com/v1/realtime/sessions',
                headers={
                    'Authorization': f'Bearer {openai_api_key}',
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
