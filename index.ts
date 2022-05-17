import totp from "totp-generator";
import { renameSync } from "fs";
import { webhookFiles, webhookPayload } from "./src/api/webhookFire";
import { webhook, pass32, time } from "./src/settings";
import type { fileType, Requ, Resp } from "./src/types/types";
import RateLimit from "./src/api/ratelimit";
import api from "./src/api";
import "./src/anti-crash";

async function authorized(key: string | undefined): Promise<boolean> {
  //check if key is correct
  if (key && key === totp(pass32)) return true;
  return false;
}

async function setStatus(res: Resp, code: number, text?: string): Promise<void> {
  //respond to the request
  res.status(code).send(text || "ok");
}

const Authorize = async (res: Resp, ip: string, type: "file" | "data") => {
  //respond with ok statuscode and console log that data/file has been sent
  await setStatus(res, 200);
  console.log(`${time} Authorized IP: ${ip === "::1" ? "127.0.0.1" : ip}, sent ${type} to webhook`);
};

api.post("/", async (req: Requ, res: Resp) => {
  if (!req.fields && !req.files) return await setStatus(res, 403);
  let ip = req.header("x-forwarded-for") || req.connection.remoteAddress || req.ip || "N/A";
  const key = req.headers.authorization;
  const rateLimit = new RateLimit(ip);

  if (await authorized(key)) {
    /* if non-empty fields exist we send object to webhook and respond with 200 status code */
    if (req.fields && Object.keys(req.fields).length !== 0) {
      await webhookPayload({ hook: webhook, payload: req.fields });
      Authorize(res, ip, "data");
    }
    /* if a file object was uploaded we check if its empty and send it to the webhook and respond with 200 status code */
    if (req.files && Object.keys(req.files).length !== 0) {
      // Went thru hell with this part, any help would be appriciated to make it better 😭
      let file: fileType = JSON.parse(JSON.stringify(req.files));
      for (let i in file) {
        file = file[i];
        break;
      }
      const removeLast = file?.path.split("\\");
      removeLast.pop();
      const newFilePath = removeLast.map((x: string) => x).join("\\") + "\\" + file.name;
      renameSync(file.path, newFilePath);
      //the hell stopped here, so no need for enhancements anymore 😘
      await webhookFiles({ hook: webhook, file: newFilePath });
      Authorize(res, ip, "file");
    }
  } else {
    //ratelimit if the authorization or request method is incorrect
    if (rateLimit.exist()) {
      await setStatus(res, 429);
    } else {
      await setStatus(res, 401);
      rateLimit.timeout();
    }
  }
});
