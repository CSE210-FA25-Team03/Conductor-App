# **CI/CD Pipeline — Phase 1 Status**
## **Overview**
For Phase 1, we implemented a reliable CI/CD pipeline for our **Node.js backend** and lightweight **HTML/CSS/JS frontend**.
All changes to the protected branch must pass automated checks and receive human review; direct pushes are blocked.
The workflow runs on:
* Pull requests targeting the protected branch
* Pushes created by merging those PRs
---
## **Current Workflows**
The pipeline currently includes:
* **Backend linting (ESLint)**
* **Frontend linting (ESLint)**
* **Backend tests (Node test runner + Supertest)**
* **Backend JSDoc generation check**
* **CD packaging step that archives the app into a `.tar` artifact**
*(Frontend is static; frontend tests will be added later.)*
---
## **Pipeline Diagram**
![cicd-pipeline](./cicd.png)
---
## **Implemented Features**
### **Backend & Frontend Linting**
* ESLint runs on both backend and frontend JavaScript.
* Any lint errors fail the pipeline.
### **Backend Testing (Node + Supertest)**
* Uses Node’s built-in test runner for simplicity.
* Supertest verifies Express routes.
* Failing tests block PR merges.
### **JSDoc Validation**
* CI checks that backend JSDoc builds successfully.
* Documentation output is ignored in version control.
### **Continuous Delivery (Tarball Packaging)**
* The pipeline packages the app into a `.tar` archive as a CD artifact.
* No deployment step yet; packaging prepares us for future phases.
---
## **Branch Protection Requirements**
* **CI must pass** before merging
* **At least one reviewer approval**
* **Direct pushes are blocked**
All changes must go through a reviewed pull request and pass the CI pipeline.
---
## **Future Improvements**
* Add basic frontend tests
* Increase backend test coverage
* Consider adding coverage reporting
* Optionally publish JSDoc
* Introduce real deployment steps in later phases