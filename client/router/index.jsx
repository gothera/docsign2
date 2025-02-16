import { Route, Routes } from "react-router-dom";
import App from "../components/App";
import PDFSigner from "../components/PDFSigner";

export default function Router () {
    return (
        <Routes>
            <Route index path="/" element={<App />}/>
            <Route path="/sign/:documentID" element={<PDFSigner />}/>
        </Routes>
    )
}