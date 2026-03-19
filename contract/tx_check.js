const fs = require('fs');

const err = {
    "version": 2,
    "sender": "0x71eef8a76d4d177c6dce3ed247a33f21ae282611e1e488e1a99de257e74147de",
    "inputs": [
        {
            "Object": {
                "SharedObject": {
                    "objectId": "0x2b41b5df76c9885612c8a1b5b022a3b4ae6e81f9719083914b654a2527bed037"
                }
            }
        },
        {
            "Object": {
                "ImmOrOwnedObject": {
                    "objectId": "0xba6e5a1f9c1b8c2b697a08d02c980f3fb35fa0fe1b002360097ee01806f48723"
                }
            }
        }
    ]
};

console.log("HouseBankroll from TX:", err.inputs[0].Object.SharedObject.objectId);
console.log("SessionReceipt from TX:", err.inputs[1].Object.ImmOrOwnedObject.objectId);

try {
  const deployed = JSON.parse(fs.readFileSync('deployed.json', 'utf8'));
  console.log("HouseBankroll from Config:", deployed.objects.houseBankroll.objectId);
} catch (e) {
  console.log("Error reading deployed.json");
}
