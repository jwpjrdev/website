import * as configcat from "configcat-js";
export const configCatClient = configcat.getClient(
  "ACLbCEY2OEOIFbi28r8qNg/sAaw80cboUGdo3E_Ep-CzA"
);

export const featureFlags = {
  getademo: await configCatClient.getValueAsync("getademo", false),
};
