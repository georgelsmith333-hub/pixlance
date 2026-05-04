import { Router, type IRouter } from "express";
import healthRouter from "./health";
import imagesRouter from "./images";
import adminRouter from "./admin";
import toolsRouter from "./tools";
import progressRouter from "./progress";
import authRouter from "./auth";
import studioRouter from "./studio";
import scraperRouter from "./scraper";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(imagesRouter);
router.use(adminRouter);
router.use(toolsRouter);
router.use(progressRouter);
router.use(studioRouter);
router.use(scraperRouter);

export default router;
