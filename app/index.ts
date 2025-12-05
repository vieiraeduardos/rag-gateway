import { createApp } from "./app.js";

(async () => {
    const app = await createApp();

    app.listen({ port: Number.parseInt(process.env.PORT as string), host: process.env.HOST as string }, (err) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        console.log(`Server listening on http://${process.env.HOST}:${process.env.PORT}`);
    });
})();