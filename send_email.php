<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $form_type = trim($_POST["form_type"] ?? "");
    $sender_name = "";
    $email = "";

    if ($form_type === "service_inquiry") {
        $full_name = strip_tags(trim($_POST["full_name"]));
        $sender_name = $full_name;
        $email = filter_var(trim($_POST["email"]), FILTER_SANITIZE_EMAIL);
        $phone = trim($_POST["phone"] ?? "");
        $services = trim($_POST["services"] ?? "");
        $contact_method = $_POST["contact_method"] ?? [];
        if (!is_array($contact_method)) {
            $contact_method = [$contact_method];
        }
        $contact_method = array_map('strip_tags', $contact_method);
        $contact_method = array_filter($contact_method);

        if (empty($full_name) || empty($services) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo "Please complete the form and try again.";
            exit;
        }

        $recipient = "chris@qfwllc.com";
        $subject = "qfw service inquiry";
        $email_content = "Full Name: $full_name\n";
        $email_content .= "Email: $email\n";
        $email_content .= "Phone: " . ($phone ?: "Not provided") . "\n";
        $email_content .= "Preferred Contact Method: " . (!empty($contact_method) ? implode(", ", $contact_method) : "None selected") . "\n\n";
        $email_content .= "Services Requested:\n$services\n";
    } else {
        $name = strip_tags(trim($_POST["name"]));
        $sender_name = $name;
        $email = filter_var(trim($_POST["_replyto"] ?? ""), FILTER_SANITIZE_EMAIL);
        $message = trim($_POST["message"] ?? "");

        if (empty($name) || empty($message) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo "Please complete the form and try again.";
            exit;
        }

        $recipient = "sales@qfwllc.com";
        $subject = "New contact from $name";
        $email_content = "Name: $name\n";
        $email_content .= "Email: $email\n\n";
        $email_content .= "Message:\n$message\n";
    }

    $email_headers = "From: $sender_name <$email>";

    if (mail($recipient, $subject, $email_content, $email_headers)) {
        http_response_code(200);
        echo "Thank you! Your message has been sent.";
    } else {
        http_response_code(500);
        echo "Oops! Something went wrong, and we couldn't send your message.";
    }
} else {
    http_response_code(403);
    echo "There was a problem with your submission, please try again.";
}
?>