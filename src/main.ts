import { TokenContract } from './Token.js';
import {
  isReady,
  shutdown,
  Mina,
  PrivateKey,
  AccountUpdate,
  UInt64,
  Signature,
} from 'snarkyjs';

await isReady;

console.log('SnarkyJS loaded');

const useProof = false;

const Local = Mina.LocalBlockchain({ proofsEnabled: useProof });
Mina.setActiveInstance(Local);
const { privateKey: deployerKey, publicKey: deployerAccount } =
  Local.testAccounts[0];
const { privateKey: userKey, publicKey: userAccount } =
  Local.testAccounts[1];


const zkAppPrivateKey = PrivateKey.random();
const zkAppAddress = zkAppPrivateKey.toPublicKey();

console.log('compiling zk contract...');
let verificationKey: any; 
if (useProof) {
  ({ verificationKey } = await TokenContract.compile());
}

console.log('compiled successfully');

console.log('deploying zk contract...')
const contract = new TokenContract(zkAppAddress);
const deploy_txn = await Mina.transaction(deployerAccount, () => {
  AccountUpdate.fundNewAccount(deployerAccount);
  contract.deploy({verificationKey, zkappKey: zkAppPrivateKey});
});
await deploy_txn.prove();
await deploy_txn.sign([deployerKey, zkAppPrivateKey]).send();

console.log('deployed successfully');

console.log('initializing zk contract...');

const init_txn = await Mina.transaction(deployerAccount, () => {
  contract.init();
});

await init_txn.prove();
await init_txn.sign([deployerKey, zkAppPrivateKey]).send();

console.log('initialized');

console.log('minting tokens...');

const mintAmount = UInt64.from(1000);

const mintSignature = Signature.create(
  zkAppPrivateKey,
  mintAmount.toFields().concat(zkAppAddress.toFields())
);

const mint_txn = await Mina.transaction(deployerAccount, () => {
  AccountUpdate.fundNewAccount(deployerAccount);
  contract.mint(zkAppAddress, mintAmount, mintSignature);
});

await mint_txn.prove();
await mint_txn.sign([deployerKey]).send();

console.log('tokens minted:',
  contract.totalAmountInCirculation.get() +
  ' ' +
  Mina.getAccount(zkAppAddress).tokenSymbol
);

console.log('sending tokens to deployer...');

const sendAmount1 = UInt64.from(13);

const send_txn = await Mina.transaction(deployerAccount, () => {
  AccountUpdate.fundNewAccount(deployerAccount);
  contract.sendTokens(zkAppAddress, deployerAccount, sendAmount1);
});
await send_txn.prove();
await send_txn.sign([deployerKey, zkAppPrivateKey]).send();

console.log('tokens sent');

console.log('deployer tokens:', Mina.getBalance(deployerAccount, contract.token.id).value.toBigInt());

console.log('zkapp tokens:', Mina.getBalance(zkAppAddress, contract.token.id).value.toBigInt());

let flag1 = false;

try {
  const txn_2 = await Mina.transaction(deployerAccount, () => {
    contract.AssetProofGt10(deployerAccount);
  });
  await txn_2.prove();
  await txn_2.sign([deployerKey, zkAppPrivateKey]).send();
} catch (ex:any) {
  console.log(ex.message);
  flag1 = true;
}

if (!flag1) console.log('Deployer balance is greater than 10.')

console.log('sending tokens to user...');

const sendAmount2 = UInt64.from(3);

const txn_3 = await Mina.transaction(userAccount, () => {
  AccountUpdate.fundNewAccount(userAccount);
  contract.sendTokens(zkAppAddress, userAccount, sendAmount2);
});
await txn_3.prove();
await txn_3.sign([userKey, zkAppPrivateKey]).send();

console.log('tokens sent');

console.log('user tokens:', Mina.getBalance(userAccount, contract.token.id).value.toBigInt());

console.log('zkapp tokens:', Mina.getBalance(zkAppAddress, contract.token.id).value.toBigInt());

let flag2 = false;

try {
  const txn_4 = await Mina.transaction(userAccount, () => {
    contract.AssetProofGt10(userAccount);
  });
  await txn_4.prove();
  await txn_4.sign([userKey, zkAppPrivateKey]).send();
} catch (ex:any) {
  console.log(ex.message);
  console.log('User balance is less than 10.')
  flag2 = true;
}

if (!flag2) console.log('Account balance is greater than 10.')

console.log('Shutting down');

await shutdown();