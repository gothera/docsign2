from dataclasses import dataclass
from docx import Document
from enum import Enum
import json
from typing import List

class FieldType(Enum):
    """
    Enum for different types of form fields.
    """
    NAME = "name"
    DATE = "date"
    INITIALS = "initials"
    SIGNATURE = "signature"
    TEXT = "text"

@dataclass
class FormField:
    """
    Represents a single form field within a document.
    
    Attributes:
        type (FieldType): The type of the form field.
        x (float): The x-coordinate of the field.
        y (float): The y-coordinate of the field.
        height (float): The height of the field.
        width (float): The width of the field.
    """
    type: FieldType
    x: float
    y: float
    height: float
    width: float

@dataclass
class DocumentStructure:
    """
    Represents the structure of an internal document, including form fields.

    Attributes:
        id (str): A unique identifier for the document structure.
        document (Document): The document this structure pertains to.
        form_fields (List[FormField]): List of FormField objects within the document.
    """
    id: str
    document: Document
    form_fields: List[FormField]

    @classmethod
    def fromJSON(cls, json_str: str) -> 'DocumentStructure':
        """
        Parse a JSON string to create an instance of DocumentStructure.

        Args:
            json_str (str): JSON string representing DocumentStructure.

        Returns:
            DocumentStructure: An instance of DocumentStructure.

        Raises:
            ValueError: If JSON parsing fails or the structure is invalid.
        """
        try:
            data = json.loads(json_str)
            
            # Convert enum string to enum object for form_fields
            form_fields = [
                FormField(
                    type=FieldType[data['type']],
                    x=data['x'],
                    y=data['y'],
                    height=data['height'],
                    width=data['width']
                ) for data in data['form_fields']
            ]
            
            return cls(
                id=data['id'],
                document=Document(id), 
                form_fields=form_fields
            )
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            raise ValueError(f"Invalid JSON structure for DocumentStructure: {str(e)}")

    def toJSON(self) -> str:
        """
        Convert this DocumentStructure instance to a JSON string.

        Returns:
            str: JSON string representation of this instance.
        """
        
        data = {
            'id': self.id,
            'document': {},
            'form_fields': [
                {
                    'type': field.type.value,
                    'x': field.x,
                    'y': field.y,
                    'height': field.height,
                    'width': field.width
                } for field in self.form_fields
            ]
        }
        return json.dumps(data)
