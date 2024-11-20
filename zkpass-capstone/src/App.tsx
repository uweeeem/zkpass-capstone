import { type FormEvent, useEffect, useState } from "react";
import "./App.css";
import TransgateConnect from "@zkpass/transgate-js-sdk";
import type { Result } from "@zkpass/transgate-js-sdk/lib/types";
import { ethers } from "ethers";
import { useReadGetSecretGetSecret, useWriteGetSecretAssignSecret } from "./generated";

export type TransgateError = {
  message: string;
  code: number;
};

export type Proof = {
  taskId: `0x${string}`;
  schemaId: `0x${string}`;
  uHash: `0x${string}`;
  recipient: `0x${string}`;
  publicFieldsHash: `0x${string}`;
  validator: `0x${string}`;
  allocatorSignature: `0x${string}`;
  validatorSignature: `0x${string}`;
};

const contractAddress = "0xde9174EAaa3ee5f91f26C520b7F7315af225F1c1";

const App = () => {
  let chainParams: Proof;
  const [appId, setAppId] = useState<string>(
    "68c92aba-8546-4335-88b6-dbc8400e850b"
  );
  const [schemaId, setSchemaId] = useState<string>(
    "d377286f79644092bcd253ec629c647a"
  );

  const [result, setResult] = useState<Result | undefined>(undefined);
  const [secret, setSecret] = useState<string | undefined>("0x");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { writeContractAsync, isPending } = useWriteGetSecretAssignSecret();
  const { data, isPending: isPendingRead, refetch } = useReadGetSecretGetSecret({
    address: contractAddress,
  });

  useEffect(() => {
    console.log("isPending:", isPending, "isPendingRead:", isPendingRead, "data:", data);
    if (!isPending && !isPendingRead && data) {
      setSecret(data ?? "No secret available");
    }
  }, [isPending, isPendingRead, data]);

  const requestVerifyMessage = async (
    e: FormEvent,
    appId: string,
    schemaId: string
  ) => {
    e.preventDefault();
    setErrorMessage(null); // Clear previous errors

    try {
      const connector = new TransgateConnect(appId);
      const isAvailable = await connector.isTransgateAvailable();

      if (isAvailable) {
        const provider = window.ethereum
          ? new ethers.BrowserProvider(window.ethereum)
          : null;
        if (!provider) {
          throw new Error("Ethereum provider not found. Ensure Metamask is installed.");
        }

        const signer = await provider.getSigner();
        const recipient = await signer.getAddress();
        const res = (await connector.launch(schemaId, recipient)) as Result;

        console.log("Result:", res);

        const validatedResult = connector.verifyProofMessageSignature(
          "evm",
          schemaId,
          res
        );

        if (validatedResult) {
          alert("Validation Successful");
          console.log(res);
          setResult(res);

          // Convert fields to hex for contract interaction
          const taskId = ethers.hexlify(ethers.toUtf8Bytes(res.taskId)) as `0x${string}`;
          const schemaIdHex = ethers.hexlify(ethers.toUtf8Bytes(schemaId)) as `0x${string}`;

          if (recipient) {
            chainParams = {
              taskId,
              schemaId: schemaIdHex,
              uHash: res.uHash as `0x${string}`,
              recipient: recipient as `0x${string}`,
              publicFieldsHash: res.publicFieldsHash as `0x${string}`,
              validator: res.validatorAddress as `0x${string}`,
              allocatorSignature: res.allocatorSignature as `0x${string}`,
              validatorSignature: res.validatorSignature as `0x${string}`,
            };
            await writeContractAsync({
              address: contractAddress,
              args: [chainParams],
            });
            await refetch();
          }
        }
      } else {
        throw new Error(
          "zkPass Transgate not available. Install it from the Chrome Web Store."
        );
      }
    } catch (error) {
      console.error("Verification Error:", error);
      const transgateError = error as TransgateError;
      setErrorMessage(transgateError.message || "Unknown error occurred");
    }
  };

  return (
    <div className="app">
     
      {errorMessage && <p className="error">{errorMessage}</p>}
      <form
        className="form"
        onSubmit={(e) => requestVerifyMessage(e, appId, schemaId)}
      >
        <div>
          <label htmlFor="app-id" style={{ fontSize: "16px" }}>AppId:</label>
          <input
            id="app-id"
            type="text"
            placeholder="Your App ID"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            style={{ width: "100%", fontSize: "25px" }} // Increase font size
          />
        </div>

        <div>
          <label htmlFor="schema-id" style={{ fontSize: "16px" }}>SchemaId:</label>
          <input
            id="schema-id"
            type="text"
            placeholder="Your Schema ID"
            value={schemaId}
            onChange={(e) => setSchemaId(e.target.value)}
            style={{ width: "100%", fontSize: "25px" }} // Increase font size
          />
        </div>

        <div>
          <button type="submit" style={{ fontSize: "16px" }}>Start Verification</button>
        </div>
      </form>

      {result && (
        <div>
          <pre>Result: {JSON.stringify(result, null, 2)}</pre>
          <h2>Secret: {secret}</h2>
        </div>
      )}
    </div>
  );
};

export default App;
