import app from './server';
import config from '../config.json';
import process from "process";
import 'dotenv/config';

if (process.pid) {
	console.log("This runs on PID: " + process.pid)
}


// Start the application by listening to specific port
const port = Number(process.env.PORT || config.PORT || 8080);


app.listen(port, () => {
  console.info('Express application started on port: ' + port);
});

