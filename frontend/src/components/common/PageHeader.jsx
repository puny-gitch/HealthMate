import { NavBar } from "antd-mobile";
import { useNavigate } from "react-router-dom";

function PageHeader({ title, back = false, right }) {
  const navigate = useNavigate();
  return <NavBar back={back ? "返回" : null} onBack={() => navigate(-1)} right={right}>{title}</NavBar>;
}

export default PageHeader;
