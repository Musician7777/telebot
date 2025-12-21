import { app } from "./app.js";
import dotenv from 'dotenv';
const port = 3000;

const result = dotenv.config({
  path: "./.env",
});
//env is loaded or not.
if(result.error){
  throw result.error;
}else{
  console.log("Environment varialbes loaded -> Successfully");
}

app.on('error', (error)=>{
  console.log("Error : ",error);
  throw error;
})

app.listen(port || 8080, () => {
  console.log(`App listening on port http://localhost:${process.env.PORT}`)
});
