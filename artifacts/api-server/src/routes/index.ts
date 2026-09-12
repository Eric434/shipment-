import { Router, type IRouter } from "express";
import healthRouter from "./health";
import notifyRouter from "./notify";
import packagesRouter from "./packages";
import adminRouter from "./admin";
import basemapsRouter from "./basemaps";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminRouter);
router.use(packagesRouter);
router.use(notifyRouter);
router.use(basemapsRouter);

export default router;
