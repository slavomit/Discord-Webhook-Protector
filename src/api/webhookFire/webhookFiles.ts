import FormData from "form-data";
import fs from "fs";
import type { webhookFileType } from "../../types/types";

const webhookFiles = async ({ hook, file }: webhookFileType): Promise<void> => {
  try {
    const form = new FormData();

    form.append("file", fs.createReadStream(file));

    form.submit(hook, (err, response) => {
      if (err) throw new Error(err.message);
      else {
        if (response.statusCode !== (204 && 200)) {
          throw new Error(`Error sending webhook: ${response.statusCode} status code.`);
        }
      }
    });
  } catch (err: any) {
    throw new Error(err.message);
  }
};

export default webhookFiles;
