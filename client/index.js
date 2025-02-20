import { config } from 'dotenv';
config({path: '../.env'}); // This loads .env into process.env
console.log(process.env)

import App from "../components/App";

export default function Index() {
  return <App />;
}