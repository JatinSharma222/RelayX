import { WebSocketGateway } from "./gateway/websocket-gateway";

const PORT = Number(process.env.WS_PORT ?? 8080);

new WebSocketGateway(PORT);
