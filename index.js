const mongoose = require('mongoose');
const WebSocket = require('ws');

// Connect to your MongoDB database
const mongoUri = 'mongodb://127.0.0.1/TelemetryMod';
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });

// Define your MongoDB model
const playerStateSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const PlayerState = mongoose.model('PlayerState', playerStateSchema);

const port = 8080;
const wss = new WebSocket.Server({ port: port });

wss.on('connection', ws => {
  ws.on('message', async message => {
    try {
      // Parse the JSON message
      let data = JSON.parse(message);

      // Unnest the data and form it into the desired format
      let id = data.PlayerStateUpdate.id;
      let tick = data.PlayerStateUpdate.data.tick;
      let player = Object.keys(data.PlayerStateUpdate.data).filter(key => key !== 'tick')[0];
      let changeSet = data.PlayerStateUpdate.data[player];

      // Flatten changeSet into the main object
      let flattenedData = {tick, player, ...changeSet};

      // Check if data already exists
      const existingData = await PlayerState.findOne({id: id});

      if (!existingData) {
        // Save the message data in MongoDB
        const playerState = new PlayerState(flattenedData);
        await playerState.save();

        console.log('Saved data: %s', JSON.stringify(flattenedData));

        // Send back an acknowledgement that the data has been saved
        ws.send(JSON.stringify({
          status: 'success',
          message: 'Data saved successfully',
          data: {id: id}
        }));
      } else {
        console.log('Data already exists. Skipping.');
        // Send back an acknowledgement that the data was skipped because it already exists
        ws.send(JSON.stringify({
          status: 'skipped',
          message: 'Data already exists. Skipping.',
          data: {id: id}
        }));
      }
    } catch (err) {
      console.error('Failed to save %s: %s', message, err);
      // Send back an error message
      ws.send(JSON.stringify({
        status: 'error',
        message: 'Failed to save data',
        data: {id: id}
      }));
    }
  });
});

console.log(`WebSocket server started on port ${port}`);
