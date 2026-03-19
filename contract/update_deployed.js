const fs = require('fs');
const data = JSON.parse(fs.readFileSync('deployed.json', 'utf8'));

data.version = 5;
data.deployedAt = new Date().toISOString();
data.transactionDigest = "GsPCiLijY2u6Uq72fmmTP81AEpFRTTYzrxQPx4jG8bqE";
data.packageId = "0x9648be59effa27966ee8cc0a531cdefac977bb6444dcf5df96c37304eefa46b3";

data.objects.gameStore.objectId = "0x01ab2998fc05734282f9fdb99a6d3e083a3c17d0389bb12694f9d585dcae2965";
data.objects.gameStore.version = 210395995;
data.objects.gameStore.digest = "9xW2ceSyKF1b7yJB957eoTcHnfNijkSW7iJDce6rtMc5";

data.objects.adminCap.objectId = "0x62e15e10b85ec01000f0d23b072f49fa8c23d20edc4f7c3da42983f04015b910";
data.objects.adminCap.version = 210395995;
data.objects.adminCap.digest = "FJVbGPabex5AEgkUVYAzRwBmsQ4CBBCR6wsS9uPj86hv";

data.objects.houseBankroll.objectId = "0x2b41b5df76c9885612c8a1b5b022a3b4ae6e81f9719083914b654a2527bed037";
data.objects.houseBankroll.version = 210395995;
data.objects.houseBankroll.digest = "494cPoLb28NxsYWFJHY6cFEiZwWUS6ZqpYKckmLqEEKn";

data.objects.casinoAdminCap.objectId = "0x05981e384bdddeed41f200dd451c6c18fcc9373b0eb748d255ca0c811ccfff83";
data.objects.casinoAdminCap.version = 210395995;
data.objects.casinoAdminCap.digest = "BJbei5rUAT4hHBD5x6U3mnuijqev6R8dPJFdRkS5EWK9";

data.objects.upgradeCap.objectId = "0x69bb852c9ed7728ded4d1b8a4c96158f5c8942b9e3145e4dde50cecbdb740f3c";
data.objects.upgradeCap.version = 210395995;
data.objects.upgradeCap.digest = "6pEHV6XvGsowMyfwfPRPBLQ1qjamG9GJMPrTXCo8Gq8n";

data.explorerLinks.package = "https://onescan.cc/testnet/object/" + data.packageId;
data.explorerLinks.gameStore = "https://onescan.cc/testnet/object/" + data.objects.gameStore.objectId;
data.explorerLinks.houseBankroll = "https://onescan.cc/testnet/object/" + data.objects.houseBankroll.objectId;

fs.writeFileSync('deployed.json', JSON.stringify(data, null, 2));
