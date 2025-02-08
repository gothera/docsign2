from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE 
from typing import Optional, Union, List, Tuple

class DocEditor:

    def __init__(self, document: Union[Document, str] = None, outputFileName: Optional[str] = '', debug: Optional[bool] = False):
        if document is None:
            raise ValueError("document cannot be None")
        if isinstance(document, str):
            if not outputFileName:
                outputFileName = document[:-5] + '_output.docx'
            document = Document(document)
        
        self.debug = debug
        self.outputFileName = outputFileName
        self.document: Document = document
    
    def replaceText(self, oldText: str, newText: str, save: bool = False) -> Document:
        if not oldText:
            if newText:
                raise ValueError('oldText can not be empty')
            return self.debug
        if save and not self.outputFileName:
            raise ValueError('The document can not be save if an outputFileName was not provided in the constructor')
        
        paragraphsIndexes, offset = self.find(oldText)
        doc = self.document
        if offset != 0:
            if self.debug:
                paragraphText = doc.paragraphs[paragraphsIndexes[0]].text
                print(f'old text start in paragraph {paragraphsIndexes[0]}: "{paragraphText}" at offset {offset} ("{paragraphText[offset:]}")')

            raise ValueError('oldText starts in the midle of a paragraph')
        
        if len(paragraphsIndexes) == 0:
            raise RuntimeError(f'The list of paragraphs contianing the text is empty')

        # hopefully the most common case:
        if len(paragraphsIndexes) == 1:
            doc.paragraphs[paragraphsIndexes[0]].text = newText
            if save:
                doc.save(self.outputFileName)
            return self.document
        
        paragraphsToChange = [doc.paragraphs[i] for i in paragraphsIndexes]
        firstParaStyle = paragraphsToChange[0].style
        allSameStyle = True
        for paragraph in paragraphsToChange[1:]:
            if paragraph.style.name != firstParaStyle.name:
                allSameStyle = False
                break
        
        if not allSameStyle:
            raise NotImplementedError('Not implemented methode to change multiple paragraphs with difrent styles')
        
        # TODO: implement a nicer split
        no = len(paragraphsToChange)
        for i, paragraph in enumerate(paragraphsToChange):
            start, end = i * len(newText) // no, (i + 1) * len(newText) // no
            paragraph.text = newText[start:end]

        if save:
            doc.save(self.outputFileName)

        return self.document

    def find(self, text: str) -> Tuple[List[int], int]:
        doc: Document = self.document
        partialSum = 0
        indexes = [partialSum]
        for p in doc.paragraphs:
            # in between every paragraph is a '\n' character as separator
            partialSum += len(p.text) + 1
            indexes.append(partialSum)
        
        if self.debug:
            print('finding: ', text)
            print('List of starting indeces: ', indexes) 

        fullText = '\n'.join([p.text for p in doc.paragraphs])
        indexInText = fullText.find(text)

        if indexInText == -1:
            raise ValueError(f"The substring '{text}' was not found in the Document")            

        if self.debug:
            print(f'index in full text: {indexInText}, len text: {len(text)}')

        indexFirstParagraph, indexLastParagraph = -1, -1
        for i, index in enumerate(indexes):
            if index <= indexInText < indexes[i+1]:
                indexFirstParagraph = i
                break

        if indexFirstParagraph != -1:
            for i in range(indexFirstParagraph, len(indexes)):
                if indexes[i] < indexInText + len(text) <= indexes[i+1]:
                    indexLastParagraph = i
                    break

        if indexFirstParagraph == -1 or indexLastParagraph == -1:
            raise RuntimeError(f'The paragraphs contianing the text was not found (indexFirstParagraph={indexFirstParagraph}, indexLastParagraph={indexLastParagraph})')
        
        offset = indexInText - indexes[indexFirstParagraph]
        if self.debug:
            print(f'indexFirstParagraph={indexFirstParagraph}, indexLastParagraph={indexLastParagraph}, offset={offset}')

        return list(range(indexFirstParagraph, indexLastParagraph + 1)), offset


# path_root = '/Users/Adrian/Projects/docsign2/'
# exampleFile = 'data/testUploadDocument.docx'

class TestDocEditor:
    def __init__(self, debug = False):
        # self.filename = path_root + 'data/testLongText.docx'
        self.filename = '../data/testLongText.docx'
        self.document = Document(self.filename)
        self.docEditor = DocEditor(document=self.filename, debug=debug)
    
    def testReplaceTextSigleParagraphs(self):
        # test changing a single paragraph
        targetIndex = 4
        oldText = self.document.paragraphs[targetIndex].text
        newText = 'This text was replaced'
        editedDoc = self.docEditor.replaceText(oldText, newText, save=True)
        assert editedDoc.paragraphs[targetIndex].text == newText, f'Paragraph {targetIndex} from the doc shoud be "{newText}" but is "{editedDoc.paragraphs[targetIndex].text}"\n"'


    def testReplaceTextMultipleParagraphs(self):
        targetIndexes = [8, 9, 10]
        newText = 'This text was replaced\nThis text was replaced\nThis text was replaced!'
        oldText = '\n'.join([self.document.paragraphs[i].text for i in targetIndexes])
        editedDoc = self.docEditor.replaceText(oldText, newText, save=True)
        
        no = len(targetIndexes)
        for i, targetIndex in enumerate(targetIndexes):
            print(editedDoc.paragraphs[targetIndex].text)
        for i, targetIndex in enumerate(targetIndexes):
            start, end = i * len(newText) // no, (i + 1) * len(newText) // no
            print(start, end)
            assert editedDoc.paragraphs[targetIndex].text == newText[start:end], f'Paragraph {targetIndex} from the doc shoud be "{newText[start:end]}" but is "{editedDoc.paragraphs[targetIndex].text}"\n"'


    def testFindText(self):
        targetIndexes = [8, 9, 10]
        text = '\n'.join([self.document.paragraphs[i].text for i in targetIndexes])
        listIndexes, offset = self.docEditor.find(text)
        assert offset == 0, f'offset shoud be 0 but is {offset}'
        assert listIndexes == targetIndexes, f'listIndexes shoud be {targetIndexes} but is {listIndexes}'


class printdocs:
    @staticmethod
    def print_text(document):
        for paragraph in document.paragraphs:
            print(f'{paragraph.text} (style: {paragraph.style}, alignment: {paragraph.alignment}')
            # print()

    @staticmethod
    def print_styles(document, filter=None):
        l = document.styles
        if filter:
            l = [s for s in l if s.type == filter]
        for style in l:
            print(f'Style: {style.name}  style type: {style.type}')

    @staticmethod
    def print_table(document):
        for table in document.tables:
            for row in table.rows:
                for cell in row.cells:
                    print(cell.text)

    @staticmethod            
    def print_header_footer(document):
        for section in document.sections:
            print(section.header.paragraphs[0].text if section.header.paragraphs else 'No header')  # Assumes there's text in the first paragraph of the header
            print(section.footer.paragraphs[0].text if section.footer.paragraphs else 'No footer')  # Assumes there's text in the first paragraph of the footer


def test():
    document = Document(path_root + file)
    # print_text(document)
    printdocs.print_styles(document, WD_STYLE_TYPE.PARAGRAPH)
    print()

    ltDocument = Document(path_root + 'data/testLongText.docx')
    printdocs.print_styles(ltDocument, WD_STYLE_TYPE.PARAGRAPH)
    # print_text(ltDocument)
    print()

    WpDocument = Document(path_root + 'data/WP3.docx')
    printdocs.print_styles(WpDocument)
    # print_text(WpDocument)
    print()

    WpDocument = Document(path_root + 'data/WP3_older_document_version.docx')
    printdocs.print_styles(WpDocument)


if __name__ == '__main__':
    # ltDocument = Document(path_root + 'data/testLongText.docx')
    # text = '\n'.join([p.text for p in ltDocument.paragraphs])
    # print(text)
    # printdocs.print_text(ltDocument)
    tester = TestDocEditor(debug=True)
    # tester.testFindText()
    # tester.testReplaceTextSigleParagraphs()
    tester.testReplaceTextMultipleParagraphs()
