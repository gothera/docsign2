import base64
from dataclasses import dataclass, asdict
from enum import Enum
import json
import os
from typing import List


class FieldType(Enum):
    NAME = 'name'
    DATE = 'date'
    INITIALS = 'initials'
    SIGNATURE = 'signature'
    TEXT = 'text'

@dataclass
class FormField:
    id: str
    pageNumber: int
    x: float
    y: float
    height: float
    width: float
    type: FieldType

class DocumentStatus(Enum):
    CREATED = 'created'
    WAITING = 'waiting'
    SIGNED = 'signed'

class EnumEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Enum):
            return obj.value
        return json.JSONEncoder.default(self, obj)

@dataclass
class DocumentMetadata:
    id: str
    name: str
    senderEmail:str
    senderName: str
    signerEmail: str
    signerName: str
    status: DocumentStatus

    def toJSON(self):
        return json.dumps(asdict(self), cls=EnumEncoder)


@dataclass
class InternalDocument:
    id: str
    path: str
    # formFields: List[FormField]
    formFields: List
    metadata: DocumentMetadata

    @staticmethod
    def getPathFromId(id: str) -> str:
        return base64.b64decode(id.encode('utf-8')).decode('utf-8')
    
    @staticmethod
    def getIdFromPath(path: str) -> str:
        if path.endswith('.docx') or path.endswith('.json'):
            path = path[:-5]
        return base64.b64encode(path.encode('utf-8')).decode('utf-8')
    
    @classmethod
    def initFromPath(cls, path: str) -> 'InternalDocument':
        if path.endswith('.docx') or path.endswith('.json'):
            path = path[:-5]
        document = cls(id=cls.getIdFromPath(path), path=path, formFields=[], metadata=None)

        try:
            with open(document.metadataPath, 'r') as f:
                document.metadata = DocumentMetadata(**json.load(f))
        except:
            pass
        
        try:
            with open(document.formFieldsPath, 'r') as f:
                # document.formFields = [FormField(**formDict) for formDict in json.load(f)]
                document.formFields = json.load(f)
        except:
            pass
        
        return document
    
    @classmethod
    def initFromId(cls, id: str) -> 'InternalDocument':
        return cls.initFromPath(cls.getPathFromId(id))
    
    def save(self):
        with open(self.metadataPath, 'w') as f:
            f.write(self.metadata.toJSON())
        with open(self.formFieldsPath, 'w') as f:
            # json.dump([asdict(formField) for formField in self.formFields], f, cls=EnumEncoder)
            json.dump(self.formFields, f, cls=EnumEncoder)

    @property
    def docxPath(self):
        return self.path + '.docx'
    
    @property
    def formFieldsPath(self):
        return self.path + '.formFields.json'
    
    @property
    def metadataPath(self):
        return self.path + '.metadata.json'
    
    @property
    def pdfPath(self):
        return self.path + '.pdf'
    
    @property
    def signPdfPath(self):
        return self.path + 'signed.pdf'


if __name__ == '__main__':
    path = '../data/startup.docx'
    document = InternalDocument.initFromPath(path)
    print(document.docxPath, document.formFieldsPath, document.metadataPath, document.pdfPath, document.signPdfPath)

    defaultText = 'test'
    document.metadata = DocumentMetadata(
        name=defaultText,
        id=InternalDocument.getIdFromPath(path),
        senderEmail=defaultText,
        senderName=defaultText,
        signerEmail=defaultText,
        signerName=defaultText,
        status=DocumentStatus.WAITING
    )
    document.save()

    document = document.initFromPath(path)
    print(document.metadata)
    
    document.formFields = [asdict(FormField('id', FieldType.SIGNATURE, i + 1, i, i + 1, i + 2, i + 3)) for i in range(3)]
    document.save()
    
    document = document.initFromPath(path)
    print(document.formFields)

