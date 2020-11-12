## Tutorial CAP MTA XSUAA su Business Application Studio

1. Creare un dev space per SAP Business Application su Business Application Studio (BAS)

1. Creare un nuovo progetto CAP tramite wizard nel BAS

1. Nel file `package.json` nella root del progetto, inserire sotto `cds` le seguenti proprietà:
    ```json
    "cds": {
      "requires": {
        "db": {
          "kind": "hana",
          "model": "gen/csn.json"
        },
        "uaa": {
          "kind": "xsuaa"
        }
      },
      "auth": {
        "passport": {
          "strategy": "JWT"
        }
      }
    }
    ```

1. Implementare data model e service nei moduli `db` e `srv`.

1. Nel file `mta.yaml` inserire il modulo db sotto `modules`:
    ```yaml
    - name: <nome modulo (e.g. app-db)>
        type: hdb
        path: db
        parameters:
          memory: 256M
          disk-quota: 512M
        requires:
          - name: <nome container hdi (e.g.: app-hdi)>
          - name: <nome servizio xsuaa (e.g.: app-uaa)>
    ```
    e le risorse hdi e xsuaa sotto `resources`:
    ```yaml
    - name: <nome container hdi (e.g.: app-hdi)>
      type: com.sap.xs.hdi-container
      properties:
        hdi-container-name: '${service-name}'
    - name: <nome servizio xsuaa (e.g.: app-uaa)>
        type: org.cloudfroundry.managed-service
        parameters:
        path: ./xs-security.json
        service: xsuaa
        service-plan: application
        service-name: <nome (e.g.: app_uaa)>
    ```
    Per aggiungere i moduli bisogna farlo manualmente, mentre per i parametri e le risorse si può anche usare l'editor cliccando col tasto destro sul file `mta.yaml` -> `Open With` -> `MTA Editor`.

1. Nel file `package.json` inserire le seguenti `dependencies` (controllare per nuove versioni premendo CTRL+Spazio tra gli apici):
    ```json
    "dependencies": {
      "@sap/cds": "^4.1.9",
      "express": "^4.17.1",
      "@sap/hana-client": "^2.5.109",
      "passport": "^0.4.1",
      "@sap/xssec": "^3.0.9",
      "@sap/xsenv": "^3.0.0",
      "@sap/audit-logging": "^3.2.0"
    }
    ```

1. Eseguire il seguente comando:
    ```
    cds compile srv --to xsuaa > xs-security.json`
    ```
    per autogenerare il file `xs-security.json` con i ruoli definiti nei file cds nel modulo `srv`.

1. Eseguire `npm install` per installare le librerie necessarie.

1. Eseguire `npm start` per avviare il server in locale (sul dev space).

1. Una volta avviato, per controllare che le tabelle siano state create correttamente si può usare il tool `hana-cli` (`npm i -g hana-cli`) eseguendo qualche comando tra i seguenti:
  - `hana-cli tables` per listare le tabelle
  - `hana-cli views` per listare le views
  - `hana-cli inspectTable <nome tabella>` per listare le proprietà di una tabella
  - `hana-cli cds -t <nome tabella>` per generare un odata service temporaneo su una tabella

11. Aprire un terminale (CTRL+') ed eseguire il seguente comando:
    ```
    cds deploy --to hana:<nome container>
    ```
    Il nome del container corrisponderà a quello usato nel file `mta.yaml` (e.g.: `app-hdi`). Questo creerà le tabelle nel container specificato.

1. Nel file `mta.yaml` aggiungere l'approuter:
    ```yaml
    - name: <nome (e.g.: app-router)>
      type: approuter.nodejs
      path: app/router
      requires:
        - name: <nome risorsa xsuaa (e.g.: app-uaa)>
        - name: <nome api (e.g.: srv-api)>
          group: destinations
          properties:
            name: <nome api (e.g.: srv-api)>
            url: '~{srv-url}' # controllare corrispondenza
            forwardAuthToken: true
    ```

1. Nella cartella `app/router` creare un file `package.json` e inserire il seguente contenuto:
    ```json
    {
      "name": "approuter",
      "dependencies": {
        "@sap/approuter": "^8.5.3"
      },
      "scripts": {
        "start": "node node_modules/@sap/approuter/approuter.js"
      }
    }
    ```
    e un file `xs-app.json` con il seguente contenuto:
    ```json
    {
      "routes": [
        {
          "source": "^/(.*)",
          "destination": "<nome destination provvista dal modulo srv (e.g.: srv-api)>"
        }
      ]
    }
    ```

1. Fare click col tasto destro sul file `mta.yaml` e selezionare `Build MTA`

1. Cliccare col tasto destro sul file `.mtar` generato nella cartella `mta_archives` e selezionare `Deploy MTA Archive`

1. Se tutto è andato a buon fine, i tre moduli `db`, `srv` e `app` saranno accessibili dal cockpit. Ma `app` al momento comprende solo l'approuter

1. Per aggiungere una web app, cliccare col tasto destro sul file `mta.yaml` e selezionare `Create MTA Module from Template`

1. Seguire il wizard cliccando su `SAP Fiori Freestyle Module` -> `SAPUI5 Application` -> `Standalone Approuter` -> no authentication -> no data service. Farò riferimento al modulo web con il nome `web` sotto la cartella `app`.

1. Nel file `package-json` nella cartella `app` inserire il seguente script sotto `scripts`:
    ```json
    "scripts": {
        "start": "node node_modules/@sap/approuter/approuter.js"
    }
    ```

1. (**Locale**) Sempre nella cartella `app` creare il file `default-env.json` e inserire il seguente contenuto (`srv-api` corrisponde alla api provvista da `srv`):
    ```json
    {
      "destinations": [
        {
          "name": "srv-api",
          "url": "http://localhost:4004",
          "forwardAuthToken": true,
          "strictSSL": false
        }
      ]
    }
    ```
    Creare anche un file `default-services.json` nella stessa cartella e aggiungere la proprietà "uaa" copiando tutto il contenuto della key del servizio xsuaa creato in precedenza:
    ```json
    {
      "uaa": {
        "clientid": "...",
        "clientsecret": "..."
      }
    }
    ```
    Fare lo stesso nella root del progetto (dove si trova il file `mta.yaml`) rinominando la proprietà `uaa` in `xsuaa`:
    ```json
    {
      "xsuaa": {
        "clientid": "...",
        "clientsecret": "..."
      }
    }
    ```
    Infine, aprire il file `default-env.json` e aggiungere la proprietà `xsuaa` copiando nuovamente il contenuto della key in `credentials`:
    ```json
    "xsuaa": [
      {
        "name": "<nome servizio xsuaa>",
        "label": "xsuaa",
        "tags": ["xsuaa"],
        "credentials": {
          "clientid": "...",
          "clientsecret": "...",
        }
      }
    ]
    ```
    Questo servirà per testare il server in locale, dato che quando si esegue localmente, la webapp non legge il file `mta.yaml` e quindi non sa quali sono i servizi a cui deve collegarsi.

    Per ovviare all'errore "*The redirect_uri has an invalid domain*", inserire la seguente proprietà nel file `xs-security.json`:
    ```json
    "oauth2-configuration": {
      "redirect-uris": [
        "https://*.trial.applicationstudio.cloud.sap/**",
        "https://*.hana.ondemand.com/**"
      ]
    }
    ```

    Per testare localmente si può usare un database locale (SQLite) eseguendo il seguente comando:
    ```
    cds deploy --to sqlite
    ```
    Per riavviare la web app al cambio di un file si può usare `nodemon` (`npm install -g nodemon`) e cambiare lo script `start` nel `package.json` sotto `app` in:
    ```json
    "start": "npx nodemon -e js,xml,html,json,properties,css node_modules/@sap/approuter/approuter.js"
    ```


1. Aprire il file `xs-app.json` nella cartella `webapp` e inserire le routes:
    ```json
    "authenticationMethod": "route",
    "routes": [
      {
        "source": "^/api/(.*)$",
        "target": "$1",
        "authenticationType": "xsuaa",
        "destination": "srv-api",
        "csrfProtection": false
      },
      {
        "source": "^/web/(.*)$",
        "target": "$1",
        "authenticationType": "xsuaa",
        "localDir": "webapp"
      }
    ]
    ```

1. Aprire il file `manifest.json` nella cartella `webapp` e configurare il data source:
    ```json
    "dataSources": {
      "api": {
        "uri": "/api/<path relativo al servizio odata>",
        "type": "OData",
        "settings": {
          "odataVersion": "4.0",
          "localUri": "localService/metadata.xml"
        }
      }
    }
    ```
    e il modello:
    ```json
    "models": {
      "": {
        "type": "sap.ui.model.odata.v4.ODataModel",
        "dataSource": "api",
        "preload": true,
        "settings": {
          "operationMode": "Server",
          "groupId": "$auto",
          "updateGroupId": "batch",
          "synchronizationMode": "None",
          "autoExpandSelect": true
        }
      }
    }
    ```
<br>

A questo punto si dovrebbe poter sviluppare in locale e deployare senza problemi. <br>
Ricordare di usare il seguente comando prima di deployare l'MTA:
  ```
  cds deploy --to hana:<nome container>
  ```
e il seguente comando per ritornare in locale:
  ```
  cds deploy --to sqlite
  ```
<br>

In caso di problemi, si può usare il comando:
  ```
  cf logs --recent <nome app>
  ```
per leggere i log recenti.