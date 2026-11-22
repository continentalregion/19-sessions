import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pricingRouter from "./pricing";
import sessionsRouter from "./sessions";
import workoutsRouter from "./workouts";
import contractRouter from "./contract";

const router: IRouter = Router();

router.use(healthRouter);
router.use(pricingRouter);
router.use(sessionsRouter);
router.use(workoutsRouter);
router.use(contractRouter);

export default router;
