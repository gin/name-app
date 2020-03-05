import { types } from "@cosmwasm/sdk";
import { Encoding } from "@iov/encoding";
import MuiTypography from "@material-ui/core/Typography";
import * as React from "react";

import { useError, useSdk } from "../../service";
import { Button, useBaseStyles } from "../../theme";
import { FormValues } from "../Form";
import { coinStr } from "./helpers";
import { ADDRESS_FIELD, TransferForm } from "./TransferForm";

export interface InitMsg {
  readonly purchase_price?: types.Coin;
  readonly transfer_price?: types.Coin;
}

export interface NameDetailsProps {
  readonly contractAddress: string;
  readonly name: string;
  readonly contract: InitMsg;
}

export interface State {
  readonly owner?: string;
  readonly loading: boolean;
}

function parseQueryJson<T>(raw: Uint8Array): T {
  return JSON.parse(Encoding.fromUtf8(raw));
}

interface QueryResponse {
  readonly address: string;
}

export function NameDetails(props: NameDetailsProps): JSX.Element {
  const classes = useBaseStyles();
  const { name, contractAddress } = props;
  const { address, getClient } = useSdk();
  const { setError } = useError();

  const [state, setState] = React.useState<State>({ loading: false });

  React.useEffect(() => {
    setState({ loading: true });
    getClient()
      .queryContractSmart(contractAddress, { resolverecord: { name } })
      .then(res => {
        const o = parseQueryJson<QueryResponse>(res);
        setState({ owner: o.address, loading: false });
      })
      .catch(err => {
        setState({ loading: false });
        // a not found error means it is free, other errors need to be reported
        if (!err.toString().includes("NameRecord not found")) {
          setError(err);
        }
      });
  }, [getClient, setError, contractAddress, name]);

  // TODO: add visual feedback for "in process state"
  const doPurchase = async (): Promise<boolean> => {
    /* eslint-disable-next-line @typescript-eslint/camelcase */
    const { purchase_price: purchasePrice } = props.contract;
    const payment = purchasePrice ? [purchasePrice] : undefined;
    try {
      await getClient().execute(
        contractAddress,
        { register: { name: props.name } },
        "Buying my name",
        payment,
      );
      setState({ owner: address, loading: false });
    } catch (err) {
      setError(err);
    }
    return true;
  };

  const doTransfer = async (values: FormValues): Promise<void> => {
    const { transfer_price: transferPrice } = props.contract;
    const payment = transferPrice ? [transferPrice] : undefined;
    const newOwner = values[ADDRESS_FIELD];
    setState({ loading: true });
    try {
      await getClient().execute(
        props.contractAddress,
        { transfer: { name: props.name, to: newOwner } },
        "Transferring my name",
        payment,
      );
      setState({ owner: newOwner, loading: false });
    } catch (err) {
      setState({ loading: false });
      setError(err);
    }
  };

  // TODO: clean up all this logic.
  // Use separate route for the transfer form (just inline the button, then new page for form)
  // TODO: better loading state feedback

  if (state.owner) {
    const selfOwned = state.owner === address;
    if (selfOwned) {
      return (
        <div className={classes.card}>
          <MuiTypography color="secondary" variant="h6">
            You own {props.name}
          </MuiTypography>
          <MuiTypography variant="body2">Do you want to transfer it?</MuiTypography>
          <MuiTypography className={classes.bottomSpacer} variant="body2">
            Price: {coinStr(props.contract.transfer_price)}
          </MuiTypography>
          <TransferForm handleTransfer={doTransfer} />
        </div>
      );
    }
    return (
      <div className={classes.card}>
        <MuiTypography color="secondary" variant="h6">
          {props.name} is owned
        </MuiTypography>
        <span>Owned by: {state.owner}</span>
      </div>
    );
  }

  return (
    <div className={classes.card}>
      <MuiTypography className={classes.isFree} variant="h6">
        {props.name} is available.
        <br />
        Price: {coinStr(props.contract.purchase_price)}
      </MuiTypography>
      <Button color="primary" type="submit" onClick={doPurchase}>
        Register
      </Button>
    </div>
  );
}
